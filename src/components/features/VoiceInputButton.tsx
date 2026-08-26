import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Check, X, Volume2, AlertCircle } from 'lucide-react';
import { parseVoiceInputWithAI, ParsedVoiceCriteria } from '../../services/ai/voiceParserService';
import toast from 'react-hot-toast';

interface VoiceInputButtonProps {
  onApplyCriteria: (entries: ParsedVoiceCriteria[]) => void;
  availableCriteriaNames?: string[];
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onApplyCriteria,
  availableCriteriaNames = [],
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedVoiceCriteria[] | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [manualSpokenText, setManualSpokenText] = useState('');

  const recognitionRef = useRef<any>(null);

  // Khởi tạo Web Speech Recognition nếu trình duyệt hỗ trợ
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech Recognition Error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Vui lòng cấp quyền truy cập Microphone cho trình duyệt.');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleStartRecording = () => {
    setTranscript('');
    setParsedResults(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast('Đang lắng nghe... Hãy đọc to kết quả kiểm nghiệm.', { icon: '🎙️' });
      } catch (e) {
        console.error(e);
      }
    } else {
      // Fallback nếu trình duyệt không hỗ trợ Web Speech API trực tiếp
      setShowPreviewModal(true);
    }
  };

  const handleStopRecordingAndParse = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    const textToProcess = transcript.trim();
    if (!textToProcess) {
      toast.error('Chưa ghi nhận được giọng nói. Vui lòng thử lại hoặc nhập câu đọc.');
      return;
    }

    setIsParsing(true);
    setShowPreviewModal(true);

    try {
      const parsed = await parseVoiceInputWithAI(textToProcess, availableCriteriaNames);
      setParsedResults(parsed);
    } catch (err: any) {
      toast.error('Lỗi phân tích giọng nói: ' + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleManualParse = async () => {
    if (!manualSpokenText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseVoiceInputWithAI(manualSpokenText, availableCriteriaNames);
      setParsedResults(parsed);
    } catch (err: any) {
      toast.error('Lỗi phân tích câu đọc: ' + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyToForm = () => {
    if (parsedResults && parsedResults.length > 0) {
      onApplyCriteria(parsedResults);
      setShowPreviewModal(false);
      setParsedResults(null);
      setTranscript('');
      setManualSpokenText('');
      toast.success(`Đã điền ${parsedResults.length} chỉ tiêu từ giọng nói vào form!`);
    }
  };

  return (
    <>
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {isRecording ? (
          <button
            type="button"
            onClick={handleStopRecordingAndParse}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider animate-pulse shadow-lg shadow-red-200 dark:shadow-none transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            <MicOff size={14} />
            Dừng & Phân tích
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Đọc kết quả bằng giọng nói tiếng Việt"
          >
            <Mic size={14} className="text-emerald-600 dark:text-emerald-400" />
            Đọc kết quả (Voice)
          </button>
        )}
      </div>

      {/* Voice Recognition & Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-emerald-950/30 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                  <Volume2 size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                    AI Voice-to-Data Lab Assistant
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Bóc tách kết quả kiểm nghiệm từ giọng nói tiếng Việt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
              {/* Transcript Display / Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Câu nói đã thu âm / Nhập câu đọc mẫu:
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={transcript || manualSpokenText}
                    onChange={e => { setManualSpokenText(e.target.value); setTranscript(e.target.value); }}
                    placeholder='Ví dụ: "Độ ẩm 3.5%, pH 6.8, Định lượng Paracetamol 502 mg đạt, Cảm quan Đạt"'
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                  {manualSpokenText && (
                    <button
                      type="button"
                      onClick={handleManualParse}
                      disabled={isParsing}
                      className="absolute right-2 bottom-2 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow"
                    >
                      {isParsing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Phân tích lại
                    </button>
                  )}
                </div>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-500">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                  <p className="text-[11px] font-bold">AI đang phân tích và chuẩn hóa tên chỉ tiêu...</p>
                </div>
              )}

              {/* Parsed Criteria List */}
              {parsedResults && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      Danh sách chỉ tiêu nhận diện được ({parsedResults.length}):
                    </span>
                  </div>

                  {parsedResults.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl text-center font-medium">
                      Không nhận diện được chỉ tiêu nào từ câu đọc trên. Vui lòng đọc rõ tên chỉ tiêu và số đo.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                      {parsedResults.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.criteriaName}</span>
                            {item.unit && <span className="text-[10px] text-slate-400 ml-1">({item.unit})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md text-xs">
                              {item.value} {item.unit}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.isPass ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600'}`}>
                              {item.isPass ? 'Đạt' : 'K.Đạt'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              {parsedResults && parsedResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyToForm}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-200 dark:shadow-none"
                >
                  <Check size={14} />
                  Điền vào Bảng Kết Quả
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
