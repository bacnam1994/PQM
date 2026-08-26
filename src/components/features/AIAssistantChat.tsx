import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { UploadCloud, Loader2, Sparkles, Send, CheckCircle2, User, AlertCircle, X, Settings, Brain, Trash2 } from 'lucide-react';
import { geminiService, validateOCRFile, formatGeminiError, AVAILABLE_GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from '../../services/ai/geminiService';
import { buildExtractionPrompt } from '../../services/ai/prompts';
import { useAppStore } from '../../store/useAppStore';
import { useDataGraph } from '../../hooks/useDataGraph';
import { BATCH_STATUS, generateId } from '../../utils';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MappingConfirmModal, AIExtractedItem, ConfirmedMapping } from './MappingConfirmModal';
import { isCriteriaMatch } from '../../utils/aiMapping';
import { generateQualityReport } from '../../services/reportService';
import {
  recordHighConfidenceOCRMappings,
  saveSessionMemory,
  buildSessionMemoryPrompt,
  summarizeSessionWithAI,
  generateRuleBasedInsights,
  loadCachedInsights,
  saveCachedInsights,
} from '../../services/ai/autoLearningService';

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

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  sender: 'ai',
  text: 'Xin chào! Tôi là trợ lý AI của V-Biotech QMS. Tôi có thể:\n\n📄 **Nhập liệu:** Tải lên Phiếu Kiểm Nghiệm để tự động trích xuất dữ liệu.\n\n📊 **Phân tích:** Hỏi tôi về xu hướng chất lượng, tỷ lệ đạt/lỗi theo sản phẩm.\n\n⚠️ **Cảnh báo:** "Có cảnh báo chất lượng nào không?"\n\n🔬 **Dược điển:** "Giới hạn vi sinh vật cho thuốc uống là bao nhiêu?"\n\n📥 **Xuất báo cáo:** "Xuất báo cáo tháng 5 năm 2026 ra Excel"\n\nBạn muốn bắt đầu với điều gì?'
};

const CHAT_HISTORY_KEY = 'pqm_ai_chat_history';
const saveChatHistory = (msgs: ChatMessage[]) => {
  try {
    // Chỉ lưu tối đa 50 tin nhắn gần nhất để tránh tốn bộ nhớ
    const toSave = msgs.slice(-50);
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch { /* Bỏ qua nếu sessionStorage đầy */ }
};
/** Khôi phục messages từ sessionStorage */
const loadChatHistory = (): ChatMessage[] => {
  try {
    const saved = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ChatMessage[];
      if (parsed.length > 0) return parsed;
    }
  } catch { /* Bỏ qua lỗi parse */ }
  return [WELCOME_MESSAGE];
};

export const AIAssistantChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { products, tccsList, testResults, addBatch, isAdmin, aiLearnedMappings, addAiLearnedMapping, productFormulas, rawMaterials, user } = useAppStore();
  const { batches: hydratedBatches } = useDataGraph();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [currentModel, setCurrentModel] = useState(() => localStorage.getItem('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL);
  const [thinkingEnabled, setThinkingEnabled] = useState(() => localStorage.getItem('GEMINI_THINKING_ENABLED') !== 'false');

  // Xác định thực thể đang xem theo URL hiện tại để nhúng ngữ cảnh AI
  const currentContext = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/batches/')) {
      const batchId = path.split('/')[2];
      const b = hydratedBatches.find(item => item.id === batchId || item.batchNo === batchId);
      if (b) return { type: 'BATCH' as const, batch: b, label: `Lô: ${b.batchNo}` };
    }
    if (path.startsWith('/products/')) {
      const prodId = path.split('/')[2];
      const p = products.find(item => item.id === prodId || item.code === prodId);
      if (p) return { type: 'PRODUCT' as const, product: p, label: `SP: ${p.name}` };
    }
    if (path.includes('/tccs')) return { type: 'TCCS' as const, label: 'Hồ sơ TCCS' };
    if (path.includes('/quality-summary-report')) return { type: 'PQR_REPORT' as const, label: 'Báo cáo PQR' };
    if (path.includes('/trend-analysis')) return { type: 'TREND_SPC' as const, label: 'Kiểm soát SPC' };
    if (path.includes('/audit-logs')) return { type: 'AUDIT_LOGS' as const, label: 'Kiểm toán ALCOA+' };
    return { type: 'GENERAL' as const, label: 'Toàn hệ thống' };
  }, [location.pathname, hydratedBatches, products]);

  const contextualChips = useMemo(() => {
    if (currentContext.type === 'BATCH' && currentContext.batch) {
      const b = currentContext.batch;
      return [
        { icon: '🔬', text: `Thẩm định Lô ${b.batchNo}`, prompt: `Thẩm định hồ sơ chất lượng lô ${b.batchNo} và đưa ra khuyến nghị duyệt xuất xưởng` },
        { icon: '⚠️', text: 'Chỉ tiêu cận ngưỡng', prompt: `Kiểm tra xem lô ${b.batchNo} có chỉ tiêu nào sát ngưỡng giới hạn không?` },
        { icon: '📉', text: 'Dự báo độ ổn định', prompt: `Phân tích độ ổn định và hạn dùng dự báo của lô ${b.batchNo}` },
        { icon: '🛡️', text: 'Kiểm tra Audit Trail', prompt: `Rà soát lịch sử sửa đổi kết quả của lô ${b.batchNo}` }
      ];
    }
    if (currentContext.type === 'PRODUCT' && currentContext.product) {
      const p = currentContext.product;
      return [
        { icon: '📊', text: `Xu hướng Cpk ${p.code || ''}`, prompt: `Đánh giá năng lực quá trình Cpk và độ ổn định của sản phẩm ${p.name}` },
        { icon: '📦', text: 'Tổng hợp các lô', prompt: `Cho tôi xem thống kê tất cả các lô đã sản xuất của sản phẩm ${p.name}` },
        { icon: '🧪', text: 'Đối chiếu TCCS & Công thức', prompt: `Kiểm tra TCCS và công thức định lượng của sản phẩm ${p.name}` }
      ];
    }
    if (currentContext.type === 'PQR_REPORT') {
      return [
        { icon: '📝', text: 'Viết kết luận PQR', prompt: 'Soạn thảo nhận xét và đánh giá tổng thể chất lượng (Executive PQR Conclusion) cho kỳ báo cáo này' },
        { icon: '📊', text: 'Tóm tắt rủi ro Cpk', prompt: 'Tổng hợp các chỉ tiêu có Cpk dưới 1.33 và nguy cơ trong kỳ' },
        { icon: '💡', text: 'Đề xuất CAPA', prompt: 'Đề xuất các hành động khắc phục phòng ngừa CAPA cho các sự cố chất lượng' }
      ];
    }
    if (currentContext.type === 'AUDIT_LOGS') {
      return [
        { icon: '🛡️', text: 'Rà soát ALCOA+', prompt: 'Đánh giá mức độ tuân thủ toàn vẹn dữ liệu ALCOA+ và phát hiện các rủi ro' },
        { icon: '⏰', text: 'Thao tác ngoài giờ', prompt: 'Kiểm tra xem có thao tác sửa đổi dữ liệu nào thực hiện ngoài giờ hành chính hoặc cuối tuần không?' },
        { icon: '🔄', text: 'Sửa kết quả nhiều lần', prompt: 'Tìm các phiếu kiểm nghiệm bị sửa đổi nhiều lần sau khi tạo' }
      ];
    }
    if (currentContext.type === 'TCCS') {
      return [
        { icon: '🧪', text: 'Soát lỗi TCCS', prompt: 'Kiểm tra các quy chuẩn Min/Max và đơn vị đo trong TCCS' },
        { icon: '📖', text: 'Đối chiếu Dược điển VN', prompt: 'Gợi ý các chỉ tiêu kiểm nghiệm bắt buộc theo Dược điển Việt Nam V' },
        { icon: '💊', text: 'Đồng bộ từ công thức', prompt: 'Hướng dẫn đồng bộ chỉ tiêu hàm lượng từ công thức sản phẩm' }
      ];
    }
    return [
      { icon: '⚠️', text: 'Cảnh báo chất lượng', prompt: 'Kiểm tra xem có bất thường chất lượng nào không?' },
      { icon: '📊', text: 'Phân tích xu hướng', prompt: 'Phân tích xu hướng chất lượng tổng thể của tất cả sản phẩm' },
      { icon: '📥', text: 'Xuất báo cáo tháng', prompt: 'Xuất báo cáo chất lượng tháng này ra file Excel' },
      { icon: '📦', text: 'Tổng quan lô hàng', prompt: 'Cho tôi xem tổng quan tình trạng tất cả lô hàng hiện tại' },
    ];
  }, [currentContext]);

  // Lưu lịch sử chat vào sessionStorage mỗi khi messages thay đổi
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // SESSION MEMORY: Tom tat va luu khi dong chat
  const handleCloseChat = useCallback(async () => {
    setIsOpen(false);
    const realMessages = messages.filter(m => m.id !== 'msg_welcome' && (m.sender === 'user' || m.sender === 'ai'));
    if (realMessages.length >= 2 && user?.uid) {
      try {
        const msgForSummary = realMessages.map(m => ({ sender: m.sender as string, text: m.text }));
        const summary = await summarizeSessionWithAI(msgForSummary, (p: string, s?: string) => geminiService.generateText(p, s));
        if (summary) saveSessionMemory(user.uid, summary, currentModel);
      } catch { /* silent fail */ }
    }
  }, [messages, user, currentModel]);

  // MORNING BRIEFING: Hien thi AI Insights khi mo chat lan dau trong ngay
  const briefingShownKey = `pqm_briefing_shown_${new Date().toDateString()}`;
  const hasBriefingBeenShown = useRef(false);

  const triggerMorningBriefing = useCallback(() => {
    if (hasBriefingBeenShown.current) return;
    if (sessionStorage.getItem(briefingShownKey)) return;
    const cachedInsights = loadCachedInsights();
    const insightsToShow = cachedInsights.length > 0
      ? cachedInsights
      : generateRuleBasedInsights({ products, batches: hydratedBatches, testResults, aiLearnedMappings, productFormulas, rawMaterials });
    if (insightsToShow.length === 0) return;
    const insightText = insightsToShow.slice(0, 3).map(i => {
      const badge = i.severity === 'HIGH' ? '[CAO]' : i.severity === 'MEDIUM' ? '[TB]' : '[OK]';
      return badge + ' **' + i.title + '**\n' + i.detail;
    }).join('\n\n');
    setMessages(prev => [
      ...prev,
      {
        id: `msg_briefing_${Date.now()}`,
        sender: 'ai' as const,
        text: `AI Morning Briefing - ${new Date().toLocaleDateString('vi-VN')}\n\n${insightText}\n\n*Nhap "AI thay gi moi?" de xem toan bo phan tich chi tiet.*`,
      }
    ]);
    sessionStorage.setItem(briefingShownKey, '1');
    hasBriefingBeenShown.current = true;
    if (cachedInsights.length === 0) saveCachedInsights(insightsToShow);
  }, [products, hydratedBatches, testResults, aiLearnedMappings, productFormulas, rawMaterials, briefingShownKey]);

  const handleModelChange = (model: string) => {
    setCurrentModel(model);
    localStorage.setItem('GEMINI_MODEL', model);
    const mInfo = AVAILABLE_GEMINI_MODELS.find(m => m.id === model);
    toast.success(`Đã chuyển sang mô hình ${mInfo?.name || model}`);
  };

  const handleThinkingToggle = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    localStorage.setItem('GEMINI_THINKING_ENABLED', String(enabled));
    toast.success(enabled ? 'Đã bật hiển thị quy trình suy luận' : 'Đã tắt hiển thị quy trình suy luận');
  };

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [pendingHighItems, setPendingHighItems] = useState<AIExtractedItem[]>([]);
  const [pendingLowItems, setPendingLowItems] = useState<AIExtractedItem[]>([]);
  // Lưu tạm dữ liệu để navigate sau khi user xác nhận mapping
  const [pendingNavigateData, setPendingNavigateData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (products.length > 0 || testResults.length > 0) {
        setTimeout(() => triggerMorningBriefing(), 800);
      }
    }
  }, [isOpen, triggerMorningBriefing, products.length, testResults.length]);

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
  }, []);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: `msg_${Date.now()}_${Math.random()}` }]);
  };

  const handleRedirect = (metadata: any) => {
    setIsOpen(false);
    if (metadata?.path) {
      navigate(metadata.path);
    } else {
      navigate('/test-results/new', { state: { aiData: metadata?.extractedData } });
    }
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
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold">$1</a>');
  };

  // --- Lấy danh sách tên chỉ tiêu từ TCCS đang hiệu lực ---
  // Gom tất cả tên chỉ tiêu từ mọi TCCS active (dùng Set để dedup)
  const allActiveTccsNames = useMemo(() => {
    const names = new Set<string>();
    tccsList
      .filter(t => t.isActive)
      .forEach(tccs => {
        (tccs.mainQualityCriteria || []).forEach(c => c?.name && names.add(c.name));
        (tccs.safetyCriteria || []).forEach(c => c?.name && names.add(c.name));
      });
    return Array.from(names).sort();
  }, [tccsList]);

  const processFile = async (file: File) => {
    // [SECURITY] Dùng hàm validateOCRFile đã chuẩn hóa (kiểm tra kích thước + MIME type)
    const validation = validateOCRFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'File không hợp lệ.');
      return;
    }

    addMessage({
      sender: 'user',
      text: `Đã tải lên file: **${file.name}**`
    });

    setIsLoading(true);

    try {
      // Tạo prompt động với danh sách tên TCCS
      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const result = await geminiService.extractDataFromDocument(file, prompt);
      
      const batchNo = result.batchNo || '';
      
      if (!batchNo) {
         addMessage({
           sender: 'ai',
           text: 'Tôi đã đọc xong tài liệu, nhưng không tìm thấy Số Lô rõ ràng. Bạn có muốn đi tới Form để tự kiểm tra và lưu kết quả không?',
           isActionable: true,
           actionType: 'REDIRECT',
           metadata: { extractedData: result }
         });
         // Vẫn mở mapping modal nếu có chỉ tiêu đọc được
         openMappingStep(result, { batchNo: '', matchedBatch: null });
         return;
      }

      const matchedBatch = hydratedBatches.find(b => b.batchNo.toLowerCase().includes(batchNo.toLowerCase()));
      
      openMappingStep(result, { batchNo, matchedBatch });

    } catch (error: any) {
      addMessage({
         sender: 'ai',
         text: `Xin lỗi, đã có lỗi xảy ra khi phân tích tài liệu:\n\n${formatGeminiError(error)}`
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /** Xử lý batch nhiều file OCR tuần tự */
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Kiểm tra toàn bộ file trước khi bắt đầu
    const invalidFiles = files.filter(f => !validateOCRFile(f).valid);
    if (invalidFiles.length > 0) {
      const errors = invalidFiles.map(f => {
        const v = validateOCRFile(f);
        return `• ${f.name}: ${v.error}`;
      }).join('\n');
      toast.error(`Có ${invalidFiles.length} file không hợp lệ:\n${errors}`, { duration: 5000 });
      return;
    }

    if (files.length === 1) {
      // Single file → dùng flow cũ
      await processFile(files[0]);
      return;
    }

    // Batch processing
    setIsBatchProcessing(true);
    addMessage({
      sender: 'system',
      text: `🗂️ **Batch OCR:** Bắt đầu xử lý **${files.length} file** phiếu kiểm nghiệm tuần tự...`
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ current: i + 1, total: files.length });
      addMessage({
        sender: 'system',
        text: `⏳ Đang xử lý file **${i + 1}/${files.length}**: ${file.name}`
      });

      try {
        await processFile(file);
        successCount++;
      } catch {
        failCount++;
        addMessage({
          sender: 'ai',
          text: `❌ Lỗi xử lý file **${file.name}**. Bỏ qua và tiếp tục...`
        });
      }

      // Delay nhỏ giữa các file để tránh rate limit
      if (i < files.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    setBatchProgress(null);
    setIsBatchProcessing(false);
    addMessage({
      sender: 'system',
      text: `✅ **Hoàn tất Batch OCR:** ${successCount} thành công${failCount > 0 ? ` | ${failCount} lỗi` : ''}`
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

    // Cũng kiểm tra qua aiLearnedMappings để nâng confidence cho các item đã học
    const enrichedItems = rawItems.map(item => {
      if (item.confidence === 'high' && item.mappedName) return item;

      // Tìm trong learned mappings
      const learnedMatch = aiLearnedMappings.find(m =>
        isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
      );
      if (learnedMatch) {
        return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
      }
      
      // Thử fuzzy match với tên TCCS
      const fuzzyMatch = allActiveTccsNames.find(tccsName =>
        isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
      );
      if (fuzzyMatch) {
        return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
      }

      return item;
    });

    const highItems = enrichedItems.filter(i => i.confidence === 'high' && i.mappedName);
    const lowItems = enrichedItems.filter(i => i.confidence !== 'high' || !i.mappedName);

    // Lưu context để dùng sau khi user xác nhận
    setPendingNavigateData({ result, context });
    setPendingHighItems(highItems);
    setPendingLowItems(lowItems);

    if (lowItems.length > 0) {
      // Có item cần xác nhận → mở modal
      setIsMappingModalOpen(true);
    } else {
      // Tất cả đã map được → điền thẳng & auto-learn high-confidence mappings
      const autoMappings = highItems
        .filter(i => i.mappedName && i.criteriaName !== i.mappedName)
        .map(i => ({ originalName: i.criteriaName, systemName: i.mappedName }));
      if (autoMappings.length > 0) recordHighConfidenceOCRMappings(autoMappings);
      finalizeMappingAndNavigate(result, context, highItems, [], false);
    }
  };

  /**
   * Sau khi user xác nhận trong modal → điền form + lưu learned mappings
   */
  const handleMappingConfirmed = (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => {
    setIsMappingModalOpen(false);
    if (!pendingNavigateData) return;

    const { result, context } = pendingNavigateData;

    // Lưu learned mappings nếu user tick "Nhớ lần sau"
    if (rememberMappings) {
      confirmedMappings.forEach(m => {
        if (m.originalName !== m.systemName) {
          addAiLearnedMapping(m.originalName, m.systemName);
        }
      });
    }

    // AUTO-LEARN: Tu dong ghi nhan high-confidence mappings
    const autoMappings = pendingHighItems
      .filter(i => i.mappedName && i.criteriaName !== i.mappedName)
      .map(i => ({ originalName: i.criteriaName, systemName: i.mappedName }));
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
    // Merge tất cả kết quả đã map thành chuẩn để truyền vào form
    const mergedResults = [
      ...highItems.map(i => ({
        criteriaName: i.mappedName, // Dùng tên chuẩn TCCS
        aiOriginalName: i.criteriaName,
        value: i.value,
        unit: i.unit,
        limit: i.limit,
      })),
      ...confirmedLowItems.map(m => ({
        criteriaName: m.systemName,
        aiOriginalName: m.originalName,
        value: m.value,
        unit: m.unit,
        limit: m.limit,
      })),
    ];

    const enrichedResult = { ...result, testResults: mergedResults };
    const { batchNo, matchedBatch } = context;

    // Nếu AI đọc được LabName, giữ lại trong enrichedResult
    if (result.labName) {
      enrichedResult.labName = result.labName;
    }

    if (!batchNo) {
      // Không tìm được số lô → navigate thẳng
      handleRedirect({ extractedData: enrichedResult });
      return;
    }

    if (matchedBatch) {
      addMessage({
        sender: 'ai',
        text: `Tuyệt vời! Đã tìm thấy lô **${batchNo}** của sản phẩm **${matchedBatch.product?.name || ''}**.${fromModal ? ' Mapping chỉ tiêu đã được xác nhận.' : ''} Bấm vào nút bên dưới để mở form nhập liệu.`,
        isActionable: true,
        actionType: 'REDIRECT',
        metadata: { extractedData: enrichedResult }
      });
    } else {
      if (isAdmin) {
        addMessage({
          sender: 'ai',
          text: `Tôi đọc được Số lô là **${batchNo}**, nhưng lô này CHƯA CÓ trong hệ thống.\nBạn có muốn tự động tạo lô mới để tiếp tục không?`,
          isActionable: true,
          actionType: 'CREATE_BATCH',
          metadata: { extractedData: enrichedResult }
        });
      } else {
        addMessage({
          sender: 'ai',
          text: `Tôi đọc được Số lô là **${batchNo}**, nhưng lô này CHƯA CÓ trong hệ thống.\n\nBạn không có quyền tạo Lô mới. Vui lòng nhờ Quản trị viên đăng ký lô **${batchNo}** vào hệ thống trước, sau đó quay lại đây để nhập kết quả kiểm nghiệm.`,
          isActionable: false
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
      const product = products.find(p => p.id === selectedProductId);
      const mfgDate = extractedData.mfgDate ? extractedData.mfgDate.split('/').reverse().join('-') : '';
      const expDate = extractedData.expDate ? extractedData.expDate.split('/').reverse().join('-') : '';

      await addBatch({
        id: newBatchId,
        productId: selectedProductId,
        batchNo: extractedData.batchNo,
        mfgDate,
        expDate,
        status: BATCH_STATUS.TESTING,
        theoreticalYield: 0,
        actualYield: 0,
        yieldUnit: 'kg',
        createdAt: new Date().toISOString(),
        tccsId: ''
      });

      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isActionable: false } : m));

      addMessage({
        sender: 'system',
        text: `Đã tạo lô **${extractedData.batchNo}** cho sản phẩm **${product?.name}**. Bấm nút bên dưới để đi tới form.`,
        isActionable: true,
        actionType: 'REDIRECT',
        metadata: { extractedData: { ...extractedData } }
      });

    } catch (error) {
      toast.error('Có lỗi xảy ra khi tạo lô!');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const handleSendTextMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim() || isLoading) return;

    const userText = chatInputText.trim();
    setChatInputText('');
    
    addMessage({
      sender: 'user',
      text: userText
    });

    setIsLoading(true);

    try {
      const appContextData = {
        products,
        batches: hydratedBatches,
        tccsList,
        testResults,
        // FIX 8: Bổ sung productFormulas và rawMaterials để generateProductionSynthesisReport tính được % hàm lượng
        productFormulas: productFormulas || [],
        rawMaterials: rawMaterials || [],
        aiLearnedMappings: aiLearnedMappings || [],
      };
      
      // FIX 4: Lọc history chặt hơn — chỉ lấy user/ai messages thuần text,
      // bỏ qua actionable messages (ví dụ: CREATE_BATCH, REDIRECT) để tránh rác context
      const history = messages
        .filter(m =>
          m.id !== 'msg_welcome' &&
          (m.sender === 'user' || m.sender === 'ai') &&
          !m.isActionable // Bỏ qua các message có action button
        )
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        }));
      
      const preferredModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
      const sessionMemoryPrompt = user?.uid ? buildSessionMemoryPrompt(user.uid) : '';
      const aiResponse = await geminiService.chatWithAppContext(userText, appContextData, history as any, preferredModel, sessionMemoryPrompt);
      
      addMessage({
        sender: 'ai',
        text: aiResponse.text,
        thinking: aiResponse.thinking
      });
    } catch (error: any) {
      console.error("Chat Error:", error);
      addMessage({
        sender: 'ai',
        text: `Xin lỗi, tôi gặp sự cố:\n\n${formatGeminiError(error)}`
      });
    } finally {
      setIsLoading(false);
    }
  };

   if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-105 hover:bg-indigo-700 transition-all z-50 group"
      >
        <Sparkles size={24} className="group-hover:animate-pulse" />
        {messages.length > 1 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm" />
        )}
      </button>
    );
  }

  return (
    <>
      {/* Mapping Confirmation Modal */}
      <MappingConfirmModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        highConfidenceItems={pendingHighItems}
        lowConfidenceItems={pendingLowItems}
        tccsNames={allActiveTccsNames}
        onConfirm={handleMappingConfirmed}
      />

      <div className="fixed bottom-6 right-6 w-[380px] bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-8 duration-300" style={{ height: '600px', maxHeight: 'calc(100vh - 40px)' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white overflow-hidden p-1 shadow-sm">
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display='none'; }} />
              </div>
              <div className="flex flex-col">
                  <h3 className="font-black text-white text-sm tracking-wide">V-Biotech AI</h3>
                  <span className="text-[10px] font-bold text-indigo-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {AVAILABLE_GEMINI_MODELS.find(m => m.id === currentModel)?.name.replace('Gemini ', '') || currentModel}
                  </span>
              </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Clear history button */}
            <button
              onClick={() => {
                sessionStorage.removeItem('pqm_ai_chat_history');
                setMessages([WELCOME_MESSAGE]);
                toast.success('Đã xóa lịch sử trò chuyện');
              }}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Xóa lịch sử chat"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 rounded-lg transition-colors ${showConfig ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              title="Cấu hình AI nhanh"
            >
              <Settings size={18} />
            </button>
            <button onClick={handleCloseChat} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Panel Cấu hình nhanh AI */}
        {showConfig && (
          <div className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-2.5 space-y-2 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Brain size={13} className="text-indigo-500" />
                Mô hình AI:
              </span>
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-700 dark:text-zinc-300 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm max-w-[200px]"
              >
                <optgroup label="⚡ Gemini 2.5 (Tiêu chuẩn)">
                  {AVAILABLE_GEMINI_MODELS.filter(m => m.group.includes('2.5')).map(m => (
                    <option key={m.id} value={m.id}>{m.badge}</option>
                  ))}
                </optgroup>
                <optgroup label="📦 Gemini 2.0">
                  {AVAILABLE_GEMINI_MODELS.filter(m => m.group.includes('2.0')).map(m => (
                    <option key={m.id} value={m.id}>{m.badge}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-500" />
                Quy trình suy luận:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={thinkingEnabled}
                  onChange={(e) => handleThinkingToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 dark:bg-zinc-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 dark:after:border-zinc-700 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-650 dark:peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        )}

        {/* Message List */}
        <div 
          className={`flex-1 overflow-y-auto p-4 space-y-4 relative transition-colors ${isDragging ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'bg-slate-50/30 dark:bg-zinc-900/10'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm border-2 border-dashed border-indigo-400 m-2 rounded-xl">
               <div className="bg-white dark:bg-zinc-900 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border border-zinc-200 dark:border-zinc-800 animate-bounce">
                  <UploadCloud className="text-indigo-500" size={32} />
                  <span className="font-black text-indigo-700 dark:text-indigo-450">Thả file vào đây...</span>
               </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.sender === 'ai' && (
                 <div className="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden p-0.5">
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="V-Biotech" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display='none'; }} />
                 </div>
              )}
              {msg.sender === 'system' && (
                 <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <CheckCircle2 size={14} className="text-white" />
                 </div>
              )}

              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' : 
                msg.sender === 'system' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-tl-sm font-medium' :
                'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-tl-sm text-slate-700 dark:text-zinc-255 leading-relaxed'
              }`}>
                {msg.thinking && thinkingEnabled && (
                  <details className="mb-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden group shadow-sm">
                    <summary className="px-2 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 cursor-pointer flex items-center gap-1 transition-colors select-none">
                      <Sparkles size={12} className="text-indigo-500 dark:text-indigo-455 animate-pulse" />
                      <span>Quy trình suy luận của AI</span>
                    </summary>
                    <div className="p-2 text-[10px] text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50/50 dark:bg-zinc-950/50 max-h-[150px] overflow-y-auto">
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
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl space-y-2">
                     <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5"><AlertCircle size={12}/> Chọn sản phẩm cho lô mới:</p>
                     <select 
                       className="w-full bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-900/50 text-xs font-bold text-slate-800 dark:text-zinc-200 px-2 py-2 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                       value={selectedProductId}
                       onChange={(e) => setSelectedProductId(e.target.value)}
                     >
                       <option value="" disabled>-- Danh sách --</option>
                       {products.filter(p => p.status === 'ACTIVE').map(p => (
                          <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                       ))}
                     </select>
                     <button 
                       disabled={isCreatingBatch || !selectedProductId}
                       onClick={() => handleCreateBatch(msg.id, msg.metadata)}
                       className="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                     >
                       {isCreatingBatch && <Loader2 size={12} className="animate-spin" />}
                       Tạo Lô Nhanh
                     </button>
                  </div>
                )}

                {msg.isActionable && msg.actionType === 'REDIRECT' && (
                  <button 
                     onClick={() => handleRedirect(msg.metadata)}
                     className="mt-3 w-full py-2 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-black uppercase text-[10px] tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                     {msg.metadata?.path ? 'Xem Báo cáo chi tiết →' : 'Tới Form Điền Kết Quả ➔'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5">
               <div className="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden p-0.5">
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="V-Biotech" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display='none'; }} />
               </div>
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-2">
                 <span className="flex gap-1">
                   <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                   <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                   <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                 </span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Chips (Context-Aware) */}
        <div className="px-3 pt-1.5 pb-1 bg-slate-50/80 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-900 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
            {currentContext.label}
          </span>
          {contextualChips.map((chip) => (
            <button
              key={chip.text}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setChatInputText(chip.prompt);
                setTimeout(async () => {
                  if (isLoading) return;
                  setIsLoading(true);
                  addMessage({ sender: 'user', text: chip.prompt });
                  try {
                    const appContextData = {
                      products,
                      batches: hydratedBatches,
                      tccsList,
                      testResults,
                      productFormulas: productFormulas || [],
                      rawMaterials: rawMaterials || [],
                    };
                    const history = messages
                      .filter(m =>
                        m.id !== 'msg_welcome' &&
                        (m.sender === 'user' || m.sender === 'ai') &&
                        !m.isActionable
                      )
                      .map(m => ({
                        role: m.sender === 'user' ? 'user' : 'model',
                        parts: [{ text: m.text }]
                      }));
                    const preferredModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
                    const aiResponse = await geminiService.chatWithAppContext(chip.prompt, appContextData, history as any, preferredModel);
                    addMessage({ sender: 'ai', text: aiResponse.text, thinking: aiResponse.thinking });
                  } catch (error: any) {
                    addMessage({ sender: 'ai', text: `Xin lỗi, tôi gặp sự cố:\n\n${formatGeminiError(error)}` });
                  } finally {
                    setIsLoading(false);
                    setChatInputText('');
                  }
                }, 0);
              }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-100 dark:border-indigo-900/50 transition-colors whitespace-nowrap disabled:opacity-40"
            >
              <span>{chip.icon}</span>
              <span>{chip.text}</span>
            </button>
          ))}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendTextMessage} className="p-3 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-900 flex items-center gap-2">
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
          {/* Batch progress indicator */}
          {batchProgress && (
            <div className="absolute bottom-[70px] left-3 right-3 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg animate-in slide-in-from-bottom duration-200">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span>🗂️ Batch OCR: {batchProgress.current}/{batchProgress.total}</span>
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
            className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex-shrink-0"
          >
            <UploadCloud size={18} />
          </button>
          <input
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            placeholder="Hỏi thông tin dữ liệu phần mềm..."
            disabled={isLoading}
            className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full px-4 py-2 text-[13px] text-slate-700 dark:text-zinc-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all"
          />
          <button 
            type="submit" 
            disabled={!chatInputText.trim() || isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 transition-colors flex-shrink-0"
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </form>
      </div>
    </>
  );
};
