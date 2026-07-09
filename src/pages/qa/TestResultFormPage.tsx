import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTestResultForm } from '../../hooks/test-results/useTestResultForm';
import { useAppStore } from '../../store/useAppStore';
import { useDataGraph } from '../../hooks/useDataGraph';
import { ArrowLeft, Search, CheckCircle2, Package, Hash, Calendar, Clock, AlertCircle, Printer, History, Beaker, FlaskConical, ShieldCheck, ListPlus, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { formatDateStandard, TEST_RESULT_STATUS, BATCH_STATUS, normalizeSearch, parseDateToISO } from '../../utils';
import { DSFormInput, CriteriaInputGroup, SpecialCharToolbar, DSDateInput } from '../../components';
import { mapAIExtractedResultsToCriteria, isCriteriaMatch } from '../../utils/aiMapping';
import { geminiService } from '../../services/ai/geminiService';
import { buildExtractionPrompt } from '../../services/ai/prompts';
import { MappingConfirmModal, AIExtractedItem, ConfirmedMapping } from '../../components/features/MappingConfirmModal';
import { useUIStore } from '../../store/useUIStore';
import { storage } from '../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FileText, Link2, HardDrive, ExternalLink, X, PlusCircle, FileUp, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface GDFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
}

interface GDFileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: GDFile[];
  onSelectFile: (file: GDFile) => void;
  isLoading: boolean;
  folderUrl?: string;
}

const GDFileSelectorModal: React.FC<GDFileSelectorModalProps> = ({ isOpen, onClose, files, onSelectFile, isLoading, folderUrl }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-755 w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-650 text-white rounded-lg">
              <HardDrive size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Quét file từ Google Drive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chọn tệp tài liệu trong thư mục Google Drive để AI phân tích.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách file từ Google Drive...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {files.map((file) => {
                const isImage = file.mimeType.startsWith('image/');
                const isPdf = file.mimeType === 'application/pdf';
                const isSupported = isImage || isPdf;
                
                return (
                  <div 
                    key={file.id} 
                    onClick={() => isSupported && onSelectFile(file)}
                    className={`flex items-center justify-between py-3 px-2 rounded-xl transition-all ${
                      isSupported 
                        ? 'hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 cursor-pointer active:scale-[0.99]' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${isPdf ? 'bg-red-50 text-red-500' : isImage ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-705 dark:text-slate-200 truncate" title={file.name}>{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {file.mimeType.split('/').pop()?.toUpperCase()} • {file.createdTime ? new Date(file.createdTime).toLocaleDateString('vi-VN') : 'Mới'}
                        </p>
                      </div>
                    </div>
                    
                    {isSupported ? (
                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Chọn & Quét
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">
                        Không hỗ trợ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <FolderOpen size={48} className="mx-auto text-slate-200" />
              <p className="text-xs font-bold text-slate-405 uppercase">Thư mục trống!</p>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                Không tìm thấy file tài liệu nào trong thư mục Google Drive của bạn. Bạn hãy tải ảnh chụp hoặc file PDF phiếu kiểm nghiệm vào thư mục này trước.
              </p>
              {folderUrl && (
                <button
                  type="button"
                  onClick={() => window.open(folderUrl, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 transition-colors shadow-sm"
                >
                  <ExternalLink size={12} />
                  Mở Thư mục Google Drive
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TestResultFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const logic = useTestResultForm();
  const allTestResults = useAppStore(state => state.allTestResults) || [];
  const testResults = useAppStore(state => state.testResults);
  const aiLearnedMappings = useAppStore(state => state.aiLearnedMappings) || [];
  const { batches: hydratedBatches } = useDataGraph();

  // Trích xuất State/Hàm từ Hook chung
  const {
    crud, formValues, setFieldValue, setMapValue, addToArray, removeFromArray, updateInArray,
    isSubmitting, batchSearch, setBatchSearch, showBatchDropdown, setShowBatchDropdown,
    activeTCCS, manualTccsId, setManualTccsId, defaultTCCS, latestTCCS, availableTCCSList,
    existingResultsForBatch, handleBatchSelect, handleSaveResult, switchToEditMode,
    completionStatus, aiOriginMapRef
  } = logic;

  const { addAiLearnedMapping, tccsList: rawTccsList } = useAppStore();

  // --- AI Extraction State ---
  const [isAiProcessing, setIsAiProcessing] = React.useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = React.useState(false);
  const [pendingHighItems, setPendingHighItems] = React.useState<AIExtractedItem[]>([]);
  const [pendingLowItems, setPendingLowItems] = React.useState<AIExtractedItem[]>([]);
  const [pendingAiRawData, setPendingAiRawData] = React.useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  /** Tập hợp tên chỉ tiêu đã được AI điền (dùng để hiển thị badge AI trên form) */
  const [aiFilledFields, setAiFilledFields] = React.useState<Set<string>>(new Set());

  // Lấy danh sách tên chỉ tiêu từ TCCS đang hiệu lực để làm prompt
  const allActiveTccsNames = useMemo(() => {
    const names = new Set<string>();
    rawTccsList
      .filter(t => t.isActive)
      .forEach(tccs => {
        (tccs.mainQualityCriteria || []).forEach(c => c?.name && names.add(c.name));
        (tccs.safetyCriteria || []).forEach(c => c?.name && names.add(c.name));
      });
    return Array.from(names).sort();
  }, [rawTccsList]);

  // Khởi tạo State: Xác định đang ở chế độ Thêm mới hay Chỉnh sửa
  useEffect(() => {
    if (id) {
      const sourceResults = allTestResults.length > 0 ? allTestResults : testResults;
      const resToEdit = sourceResults.find(r => r.id === id);
      if (resToEdit) {
        logic.crud.openEdit(resToEdit);
        // Đổ dữ liệu cũ vào các ô Input
        logic.populateFormForEdit(resToEdit as any);
      }
    } else {
      logic.crud.openAdd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Logic tìm kiếm lô hàng cho Dropdown
  const availableBatchesForDropdown = useMemo(() => {
    const searchNormalized = normalizeSearch(batchSearch);
    return hydratedBatches.filter(b => 
      (b.status === BATCH_STATUS.PENDING || b.status === BATCH_STATUS.TESTING || b.status === BATCH_STATUS.RELEASED || b.status === BATCH_STATUS.REJECTED) && 
      (!searchNormalized || normalizeSearch(b.batchNo).includes(searchNormalized) || normalizeSearch(b.product?.name).includes(searchNormalized))
    ).slice(0, 50);
  }, [hydratedBatches, batchSearch]);

  // State lưu tạm kết quả AI nếu TCCS chưa kịp load
  const [pendingAiResults, setPendingAiResults] = React.useState<any[] | null>(null);

  // Lắng nghe khi activeTCCS thay đổi để map dữ liệu AI vào Form
  useEffect(() => {
    if (activeTCCS && pendingAiResults) {
      const allCriteria = [...(activeTCCS.mainQualityCriteria || []), ...(activeTCCS.safetyCriteria || [])];
      const mappedResults = mapAIExtractedResultsToCriteria(pendingAiResults, allCriteria, aiLearnedMappings);
      const newAiFields = new Set<string>();
      mappedResults.forEach(res => {
        if (res.criteriaName && res.value !== undefined) {
          setMapValue('testResultsMap', res.criteriaName, String(res.value));
          newAiFields.add(res.criteriaName);
          // Lưu lại tên gốc AI đã nhận dạng để học máy
          if ((res as any).aiOriginalName) {
            aiOriginMapRef.current[res.criteriaName] = (res as any).aiOriginalName;
          }
        }
      });
      setAiFilledFields(prev => new Set([...prev, ...newAiFields]));
      setPendingAiResults(null); // Clear sau khi map xong
      toast.success('Đã tự động điền kết quả vào bảng chỉ tiêu!');
    }
  }, [activeTCCS, pendingAiResults, setMapValue, aiLearnedMappings, aiOriginMapRef]);

  const handleDataExtracted = (data: any) => {
    if (!data) return;
    
    // Auto-fill testDate or mfgDate
    if (data.mfgDate || data.testDate) {
      const dateStr = data.testDate || data.mfgDate;
      setFieldValue('testDate', parseDateToISO(dateStr));
    }

    // Auto-fill Lab Name
    if (data.labName) {
      setFieldValue('labName', data.labName);
    }

    // Auto-fill Batch
    if (data.batchNo) {
      setBatchSearch(data.batchNo);
      const matchedBatch = hydratedBatches.find(b => b.batchNo.toLowerCase().includes(data.batchNo.toLowerCase()));
      if (matchedBatch) {
        handleBatchSelect(matchedBatch.id);
        setBatchSearch(`${matchedBatch.batchNo} - ${matchedBatch.product?.name}`);
      }
    }

    // Handle Test Results mapping
    if (data.testResults && Array.isArray(data.testResults)) {
      if (activeTCCS) {
        // Map ngay lập tức nếu TCCS đã load (ví dụ đang ở mode EDIT hoặc đã chọn Batch từ trước)
        const allCriteria = [...(activeTCCS.mainQualityCriteria || []), ...(activeTCCS.safetyCriteria || [])];
        const mappedResults = mapAIExtractedResultsToCriteria(data.testResults, allCriteria, aiLearnedMappings);
        
        // Theo dõi index của các item đã được map để xác định item còn dư (Extra)
        const mappedAiOriginalNames = new Set(mappedResults.map(r => (r as any).aiOriginalName));
        const newAiFields = new Set<string>();

        mappedResults.forEach(res => {
          if (res.criteriaName && res.value !== undefined) {
            setMapValue('testResultsMap', res.criteriaName, String(res.value));
            newAiFields.add(res.criteriaName);
            // Lưu lại tên gốc AI đã nhận dạng để học máy khi SAVE form
            if ((res as any).aiOriginalName) {
              aiOriginMapRef.current[res.criteriaName] = (res as any).aiOriginalName;
            }
          }
        });
        setAiFilledFields(prev => new Set([...prev, ...newAiFields]));

        // Xử lý Chỉ tiêu bổ sung (Extra Criteria) cho những item AI đọc được nhưng không khớp TCCS
        const extraResults = data.testResults.filter((r: any) => !mappedAiOriginalNames.has(r.criteriaName) && !mappedAiOriginalNames.has(r.mappedName));
        if (extraResults.length > 0) {
          extraResults.forEach((r: any) => {
            addToArray('extraCriteria', {
              id: 'extra_ai_' + Math.random().toString(36).substring(2, 9),
              name: r.criteriaName,
              value: r.value,
              unit: r.unit || '',
              limit: r.limit || ''
            });
          });
        }

        toast.success('Đã tự động điền kết quả vào bảng chỉ tiêu!');
      } else {
        // Lưu vào state để chờ TCCS load sau khi Batch được auto-select
        setPendingAiResults(data.testResults);
      }
    }
  };

  // --- Logic xử lý File và Mapping AI ---
  const handleAiFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAiProcessing(true);
    try {
      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const result = await geminiService.extractDataFromDocument(file, prompt);
      
      // Phân loại item để mapping
      const rawItems: AIExtractedItem[] = (result.testResults || []).map((r: any) => ({
        criteriaName: r.criteriaName || '',
        mappedName: r.mappedName || '',
        confidence: r.confidence || 'low',
        value: r.value || '',
        unit: r.unit || '',
        limit: r.limit || '',
      }));

      const enrichedItems = rawItems.map(item => {
        if (item.confidence === 'high' && item.mappedName) return item;
        const learnedMatch = aiLearnedMappings.find(m => isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings));
        if (learnedMatch) return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
        const fuzzyMatch = allActiveTccsNames.find(tccsName => isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings));
        if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
        return item;
      });

      const highItems = enrichedItems.filter(i => i.confidence === 'high' && i.mappedName);
      const lowItems = enrichedItems.filter(i => i.confidence !== 'high' || !i.mappedName);

      setPendingAiRawData(result);
      setPendingHighItems(highItems);
      setPendingLowItems(lowItems);

      if (lowItems.length > 0) {
        setIsMappingModalOpen(true);
      } else {
        finalizeAiMapping(result, highItems, []);
      }
    } catch (error: any) {
      toast.error('Lỗi phân tích AI: ' + error.message);
    } finally {
      setIsAiProcessing(false);
      e.target.value = '';
    }
  };

  const handleMappingConfirmed = (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => {
    setIsMappingModalOpen(false);
    if (!pendingAiRawData) return;

    if (rememberMappings) {
      confirmedMappings.forEach(m => {
        if (m.originalName !== m.systemName) {
          addAiLearnedMapping(m.originalName, m.systemName);
        }
      });
    }

    finalizeAiMapping(pendingAiRawData, pendingHighItems, confirmedMappings);
  };

  const finalizeAiMapping = (result: any, highItems: AIExtractedItem[], confirmedLowItems: ConfirmedMapping[]) => {
    const mergedResults = [
      ...highItems.map(i => ({
        criteriaName: i.mappedName,
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

    handleDataExtracted({ ...result, testResults: mergedResults });
  };

  // Lắng nghe dữ liệu AI truyền từ Global Chat Widget (nếu có)
  useEffect(() => {
    if (location.state?.aiData && !id) { // Chỉ tự động điền khi ở mode Thêm Mới
      handleDataExtracted(location.state.aiData);
      // Xóa state để không tự động điền lại khi người dùng F5 reload trang
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.aiData, location.pathname, navigate, id]);

  // --- Attachment Upload Logic ---
  const { googleDriveFolderUrl, googleDriveFolderId, googleDriveClientId, googleDriveApiKey, useGoogleDriveUpload } = useUIStore();
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [manualLink, setManualLink] = React.useState('');
  const [manualName, setManualName] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  
  const handleAddManualLink = () => {
    if (!manualLink) return;
    const name = manualName.trim() || manualLink.split('/').pop()?.split('?')[0] || 'Tài liệu Google Drive';
    const newAttachment = {
      name,
      url: manualLink,
      source: 'google_drive' as const,
      uploadedAt: new Date().toISOString()
    };
    setFieldValue('attachments', [...(formValues.attachments || []), newAttachment]);
    setManualLink('');
    setManualName('');
    toast.success('Đã gắn liên kết Google Drive thành công!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey) {
      setIsUploading(true);
      setUploadProgress(10);
      try {
        await uploadToGoogleDrive(file);
      } catch (err: any) {
        console.error("Google Drive Upload Error, falling back to Firebase Storage:", err);
        toast.error("Lỗi tải lên Google Drive: " + err.message + ". Đang chuyển sang lưu Firebase Storage...");
        await uploadToFirebaseStorage(file);
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
        e.target.value = '';
      }
    } else {
      setIsUploading(true);
      await uploadToFirebaseStorage(file);
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const uploadToFirebaseStorage = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const path = `attachments/${formValues.batchId || 'temp'}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          }, 
          (error) => {
            console.error(error);
            toast.error("Lỗi khi tải file lên Storage: " + error.message);
            reject(error);
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newAttachment = {
              name: file.name,
              url: downloadURL,
              source: 'firebase' as const,
              uploadedAt: new Date().toISOString()
            };
            setFieldValue('attachments', [...(formValues.attachments || []), newAttachment]);
            toast.success(`Đã tải lên tệp ${file.name} thành công!`);
            setUploadProgress(null);
            resolve();
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  const uploadToGoogleDrive = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const gClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: googleDriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error));
          }
          const accessToken = tokenResponse.access_token;
          
          try {
            setUploadProgress(30);
            const metadata = {
              name: file.name,
              parents: googleDriveFolderId ? [googleDriveFolderId] : []
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);
            
            setUploadProgress(60);
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`
              },
              body: form
            });
            
            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Upload API error: ${errText}`);
            }
            
            const driveFile = await response.json();
            setUploadProgress(90);
            
            const newAttachment = {
              name: file.name,
              url: driveFile.webViewLink,
              source: 'google_drive' as const,
              uploadedAt: new Date().toISOString()
            };
            
            setFieldValue('attachments', [...(formValues.attachments || []), newAttachment]);
            toast.success(`Đã tải lên Google Drive: ${file.name}`);
            setUploadProgress(null);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      });
      
      if (!gClient) {
        reject(new Error("Không thể khởi tạo Google Identity Services. Hãy đảm bảo đã thêm script của Google."));
      } else {
        gClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  };

  const handleRemoveAttachment = (idx: number) => {
    const newAttachments = [...(formValues.attachments || [])];
    newAttachments.splice(idx, 1);
    setFieldValue('attachments', newAttachments);
    toast.success('Đã gỡ bỏ tệp đính kèm.');
  };

  // --- Google Drive File Selection for AI Scanning ---
  const [isGDModalOpen, setIsGDModalOpen] = React.useState(false);
  const [gdFiles, setGDFiles] = React.useState<GDFile[]>([]);
  const [isLoadingGDFiles, setIsLoadingGDFiles] = React.useState(false);
  const [gdToken, setGdToken] = React.useState<string | null>(null);

  const handleGDScanClick = () => {
    if (!googleDriveClientId || !googleDriveFolderId) {
      toast.error("Vui lòng cấu hình Google Client ID và Đường dẫn thư mục Google Drive trong phần Cài đặt hệ thống!");
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
            toast.error("Yêu cầu đăng nhập Google Drive thất bại: " + tokenResponse.error);
            return;
          }
          const token = tokenResponse.access_token;
          setGdToken(token);
          fetchFilesFromGD(token);
        }
      });
      
      if (!gClient) {
        setIsGDModalOpen(false);
        setIsLoadingGDFiles(false);
        toast.error("Không thể khởi tạo Google API Client SDK. Vui lòng tải lại trang.");
      } else {
        gClient.requestAccessToken();
      }
    }
  };

  const fetchFilesFromGD = async (token: string) => {
    setIsLoadingGDFiles(true);
    try {
      const q = `'${googleDriveFolderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,size)&orderBy=createdTime+desc`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Không thể tải danh sách file.");
      }
      
      const data = await response.json();
      setGDFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi tải file từ Google Drive: " + err.message);
      setGdToken(null);
    } finally {
      setIsLoadingGDFiles(false);
    }
  };

  const handleSelectGoogleDriveFile = async (file: GDFile) => {
    setIsGDModalOpen(false);
    setIsAiProcessing(true);
    try {
      if (!gdToken) throw new Error("Mất kết nối tài khoản Google. Vui lòng thử lại.");
      
      const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${gdToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Lỗi khi tải nội dung file từ Drive");
      }
      
      const blob = await response.blob();
      const fileObject = new File([blob], file.name, { type: file.mimeType });
      
      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const result = await geminiService.extractDataFromDocument(fileObject, prompt);
      
      const rawItems: AIExtractedItem[] = (result.testResults || []).map((r: any) => ({
        criteriaName: r.criteriaName || '',
        mappedName: r.mappedName || '',
        confidence: r.confidence || 'low',
        value: r.value || '',
        unit: r.unit || '',
        limit: r.limit || '',
      }));

      const enrichedItems = rawItems.map(item => {
        if (item.confidence === 'high' && item.mappedName) return item;
        const learnedMatch = aiLearnedMappings.find(m => isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings));
        if (learnedMatch) return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
        const fuzzyMatch = allActiveTccsNames.find(tccsName => isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings));
        if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
        return item;
      });

      const highItems = enrichedItems.filter(i => i.confidence === 'high' && i.mappedName);
      const lowItems = enrichedItems.filter(i => i.confidence !== 'high' || !i.mappedName);

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
        uploadedAt: new Date().toISOString()
      };
      setFieldValue('attachments', [...(formValues.attachments || []), newAttachment]);
      toast.success(`Đã tự động đính kèm file quét từ Google Drive: ${file.name}`);
    } catch (error: any) {
      toast.error('Lỗi phân tích AI: ' + error.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/test-results')} 
          className="p-2 bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {id ? 'Chỉnh sửa Phiếu Kiểm Nghiệm' : 'Nhập Phiếu Kiểm Nghiệm Mới'}
        </h1>
        
        <div className="flex-1" />

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={handleAiFileSelect}
        />
        
        <button
          type="button"
          disabled={isAiProcessing}
          onClick={handleGDScanClick}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-100 transition-all disabled:opacity-50 border border-slate-700"
        >
          {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
          Quét từ Google Drive
        </button>

        <button
          type="button"
          disabled={isAiProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
        >
          {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {isAiProcessing ? 'Đang trích xuất...' : 'Nhập dữ liệu bằng AI'}
        </button>
      </div>

      <MappingConfirmModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        highConfidenceItems={pendingHighItems}
        lowConfidenceItems={pendingLowItems}
        tccsNames={allActiveTccsNames}
        onConfirm={handleMappingConfirmed}
      />

      <GDFileSelectorModal
        isOpen={isGDModalOpen}
        onClose={() => setIsGDModalOpen(false)}
        files={gdFiles}
        onSelectFile={handleSelectGoogleDriveFile}
        isLoading={isLoadingGDFiles}
        folderUrl={googleDriveFolderUrl}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <datalist id="lab-suggestions">
          <option value="Phòng QC (Nội bộ)" />
          <option value="CASE" />
          <option value="Quatest 3" />
          <option value="Eurofins" />
          <option value="Viện Pasteur" />
        </datalist>

        <form onSubmit={handleSaveResult}>
           <div className="space-y-6 pr-2">
           {/* Special Char Toolbar */}
           <SpecialCharToolbar className="-mx-2 px-2" />

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Chọn Lô hàng cần test *</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    value={batchSearch}
                    onChange={(e) => {
                      setBatchSearch(e.target.value);
                      setShowBatchDropdown(true);
                      if (!e.target.value) setFieldValue('batchId', '');
                    }}
                    onFocus={() => setShowBatchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowBatchDropdown(false), 200)}
                    placeholder="Tìm kiếm Lô hàng (Số lô hoặc Tên SP)..."
                    disabled={crud.mode === 'EDIT'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  {formValues.batchId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />}
                  
                  {showBatchDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                      {availableBatchesForDropdown.map(b => {
                        return (
                          <div 
                            key={b.id}
                            onClick={() => {
                              handleBatchSelect(b.id);
                              setBatchSearch(`${b.batchNo} - ${b.product?.name}`);
                              setShowBatchDropdown(false);
                            }}
                            className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${formValues.batchId === b.id ? 'bg-indigo-50' : ''}`}
                          >
                            <p className="text-sm font-bold text-slate-700 uppercase">Lô: {b.batchNo}</p>
                            <p className="text-[10px] font-medium text-slate-500">{b.product?.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <DSFormInput 
                    label="Tên đơn vị kiểm nghiệm *" 
                    name="labName" 
                    list="lab-suggestions"
                    value={formValues.labName}
                    onChange={(e) => setFieldValue('labName', e.target.value)}
                    required 
                    placeholder="VD: Phòng QC, CASE..." />
                </div>
                <div className="col-span-2">
                  <DSDateInput 
                    label="Ngày xuất phiếu *" 
                    name="testDate" 
                    value={formValues.testDate}
                    onChange={(val) => setFieldValue('testDate', val)}
                    required 
                  />
                </div>
              </div>
           </div>

           {/* Hiển thị tóm tắt thông tin Lô đã chọn để đối chiếu */}
           {formValues.batchId && (() => {
             const b = hydratedBatches.find(batch => batch.id === formValues.batchId);
             if (!b) return null;
             return (
               <div className="space-y-3 animate-in fade-in">
                 <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1"><Package size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">{b.product?.name}</span></div>
                    <div className="flex items-center gap-1"><Hash size={14} className="text-indigo-400"/> <span className="font-bold text-indigo-700">{b.batchNo}</span></div>
                    <div className="flex items-center gap-1"><Calendar size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">SX: {b.mfgDate ? formatDateStandard(b.mfgDate) : '---'}</span></div>
                    <div className="flex items-center gap-1"><Clock size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">HD: {b.expDate ? formatDateStandard(b.expDate) : '---'}</span></div>
                 </div>

                 {/* Cảnh báo nếu lô đã có kết quả */}
                 {existingResultsForBatch.length > 0 && (
                   <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 animate-in fade-in">
                     <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                         <AlertCircle size={12}/> Lô này đã có {existingResultsForBatch.length} phiếu kết quả:
                       </p>
                       <button type="button" onClick={() => window.open(`/test-results/coa/${formValues.batchId}`, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100">
                          <Printer size={12} /> Xem CoA Tổng hợp
                       </button>
                     </div>
                     <div className="space-y-1">
                       {existingResultsForBatch.map((r: any) => (
                         <div key={r.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-amber-100/50">
                           <span className="font-bold text-slate-600">{r.labName} <span className="font-normal text-slate-400">({formatDateStandard(r.testDate)})</span></span>
                           <div className="flex items-center gap-2">
                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.overallStatus}</span>
                             <button type="button" onClick={() => switchToEditMode(r)} className="text-[9px] font-bold text-blue-600 hover:underline">Sửa phiếu này</button>
                           </div>
                         </div>
                       ))}
                     </div>
                     <p className="text-[10px] text-amber-600/70 italic mt-2 text-center">Bạn đang tạo phiếu kết quả <b>MỚI</b> (ví dụ: gửi mẫu thêm cho đơn vị khác).</p>
                   </div>
                 )}
               </div>
             );
           })()}

           {activeTCCS ? (
             <div className="space-y-6 animate-in fade-in">
                <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-2">
                          <History size={20} /> TIÊU CHUẨN ÁP DỤNG
                        </h4>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <select 
                            value={activeTCCS.id} 
                            onChange={(e) => setManualTccsId(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {availableTCCSList.map(t => (
                                <option key={t.id} value={t.id}>{t.code} (Ban hành: {formatDateStandard(t.issueDate)})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <CriteriaInputGroup title="Lý hóa & Cảm quan" criteria={activeTCCS.mainQualityCriteria || []} icon={<Beaker size={16}/>} colorClass="text-indigo-600" activeTCCS={activeTCCS} testResultsMap={formValues.testResultsMap} setMapValue={setMapValue} existingResultsForBatch={existingResultsForBatch} aiFilledFields={aiFilledFields} />
                
                {activeTCCS.safetyCriteria && activeTCCS.safetyCriteria.length > 0 && (() => {
                  const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
                  const safety = activeTCCS.safetyCriteria || [];
                  const micro = safety.filter(c => {
                      if (!c) return false;
                      const nameLower = (c.name || '').toLowerCase();
                      if ((c as any).category === 'micro') return true;
                      if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                      return false;
                  });
                  const metal = safety.filter(c => {
                      if (!c) return false;
                      const nameLower = (c.name || '').toLowerCase();
                      if ((c as any).category === 'metal') return true;
                      if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                      return false;
                  });

                  return (
                    <>
                       {micro.length > 0 && (
                        <CriteriaInputGroup title="Giới hạn Vi sinh vật" criteria={micro} icon={<ShieldCheck size={16}/>} colorClass="text-emerald-600" activeTCCS={activeTCCS} testResultsMap={formValues.testResultsMap} setMapValue={setMapValue} existingResultsForBatch={existingResultsForBatch} aiFilledFields={aiFilledFields} />
                      )}
                      {metal.length > 0 && (
                        <CriteriaInputGroup title="Giới hạn Kim loại nặng" criteria={metal} icon={<ShieldCheck size={16}/>} colorClass="text-red-600" activeTCCS={activeTCCS} testResultsMap={formValues.testResultsMap} setMapValue={setMapValue} existingResultsForBatch={existingResultsForBatch} aiFilledFields={aiFilledFields} />
                      )}
                    </>
                  );
                })()}
             </div>
           ) : formValues.batchId && (
             <div className="p-8 text-center bg-indigo-50/30 rounded-2xl border-4 border-dashed border-indigo-100">
                <AlertCircle size={48} className="mx-auto text-indigo-200 mb-4" />
                <p className="text-sm font-black text-indigo-800 uppercase">Không tìm thấy hồ sơ TCCS hiệu lực!</p>
             </div>
           )}

           <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><ListPlus size={20} /> CHỈ TIÊU BỔ SUNG</h4>
                <button type="button" onClick={() => addToArray('extraCriteria', { id: 'extra_' + Date.now(), name: '', value: '', unit: '', limit: '' })} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-600">Thêm dòng</button>
              </div>
              {formValues.extraCriteria.map((item, idx) => (
                <div key={item.id} className="flex gap-2 items-start animate-in slide-in-from-left-2">
                  <input placeholder="Tên chỉ tiêu" value={item.name} onChange={e => updateInArray('extraCriteria', idx, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold" />
                  <input placeholder="Kết quả" value={item.value} onChange={e => updateInArray('extraCriteria', idx, 'value', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-black text-indigo-700" />
                  <input placeholder="ĐVT" value={item.unit} onChange={e => updateInArray('extraCriteria', idx, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold" />
                  <button type="button" onClick={() => removeFromArray('extraCriteria', idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
           </div>

           {/* Ghi chú */}
           <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ghi chú phiếu kiểm nghiệm</label>
              <textarea name="notes" value={formValues.notes} onChange={(e) => setFieldValue('notes', e.target.value)} rows={2} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Ghi chú thêm..." />
           </div>

           {/* Tài liệu & File đính kèm */}
           <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                  <HardDrive size={14} className="text-slate-400" />
                  Tài liệu & File đính kèm
                </label>
                <button
                  type="button"
                  onClick={() => window.open(googleDriveFolderUrl || 'https://drive.google.com', '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-sm"
                >
                  <ExternalLink size={12} />
                  Mở Thư mục Google Drive
                </button>
              </div>

              {/* Upload & Manual link grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {/* Cột 1: Tải file lên */}
                <div className="space-y-3 flex flex-col justify-center border-r border-slate-200/50 pr-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tải lên tài liệu</p>
                  <div className="relative">
                    <input
                      type="file"
                      id="attachment-file-input"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="hidden"
                      accept="image/*,application/pdf"
                    />
                    <label
                      htmlFor="attachment-file-input"
                      className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-indigo-500 rounded-xl p-4 bg-white hover:bg-indigo-50/20 cursor-pointer transition-all duration-300 group"
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="animate-spin text-indigo-600" />
                          <p className="text-xs font-bold text-slate-600">Đang tải lên... {uploadProgress != null ? `${uploadProgress}%` : ''}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <FileUp size={24} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          <p className="text-xs font-bold text-slate-700 mt-1">Chọn file ảnh hoặc PDF</p>
                          <p className="text-[10px] text-slate-400 italic">
                            Tải lên {useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey ? 'Google Drive' : 'Firebase Storage'}
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>

                {/* Cột 2: Gắn link thủ công */}
                <div className="space-y-3 flex flex-col justify-between pl-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Liên kết Google Drive thủ công</p>
                    <input
                      type="text"
                      placeholder="Dán liên kết file trong Google Drive..."
                      value={manualLink}
                      onChange={(e) => setManualLink(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <input
                      type="text"
                      placeholder="Tên gợi nhớ (VD: Ảnh phiếu QC, COA nguyên liệu...)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddManualLink}
                    disabled={!manualLink}
                    className="w-full py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase hover:bg-slate-900 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} />
                    Gắn liên kết tài liệu
                  </button>
                </div>
              </div>

              {/* Danh sách file đính kèm */}
              {formValues.attachments && formValues.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formValues.attachments.map((att: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white border border-slate-150 rounded-xl hover:shadow-md transition-all group relative">
                      <div className={`p-2 rounded-lg shrink-0 ${att.source === 'google_drive' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1 pr-6">
                        <p className="text-xs font-bold text-slate-700 truncate" title={att.name}>{att.name}</p>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-500 hover:underline inline-flex items-center gap-1 font-semibold mt-0.5"
                        >
                          Xem tài liệu <ExternalLink size={8} />
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-350 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg transition-all"
                        title="Xóa tài liệu đính kèm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic pl-2">Chưa có tài liệu hay file đính kèm nào cho phiếu kiểm nghiệm này.</p>
              )}
           </div>
           </div>

           <div className="pt-8 flex justify-end gap-3 border-t bg-white mt-8">
             <button type="button" onClick={() => navigate('/test-results')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl transition-colors">Hủy & Quay lại</button>
             <button type="submit" disabled={!activeTCCS || isSubmitting} className={`px-8 py-3 text-white font-black rounded-xl shadow-2xl transition-all uppercase text-xs tracking-widest ${crud.mode === 'EDIT' ? 'bg-blue-600 shadow-blue-100 hover:bg-blue-700' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'} disabled:opacity-20 flex items-center gap-2`}>
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {crud.mode === 'EDIT' ? 'Cập nhật Phiếu' : 'Lưu Kết quả Mới'}
             </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default TestResultFormPage;