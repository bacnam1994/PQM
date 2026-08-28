/**
 * DeviationReportModal.tsx
 * =========================
 * Modal hiển thị và tạo Báo cáo Sai lệch (Deviation Report) chuẩn GMP.
 * 
 * Layout: 3 vùng
 * - Header: Thông tin lô + Nút hành động
 * - Body: Báo cáo đầy đủ 6 phần
 * - Footer: Nút xuất / đóng
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, FileWarning, Loader2, AlertTriangle, CheckCircle2,
  Shield, Target, Lightbulb, ClipboardList, RefreshCw,
  ChevronDown, ChevronRight, Printer, Copy, Download,
  Zap, Clock, User, Activity
} from 'lucide-react';
import { generateAIDeviationReport, generateRuleBasedDeviationReport, DeviationReport, DeviationDecision } from '../../services/ai/deviationReportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    productName: string;
    batchNo: string;
    mfgDate?: string;
    expDate?: string;
    labName?: string;
    testDate?: string;
    failedCriteria: { name: string; actualValue: string | number; unit?: string; specification: string }[];
    passedCriteria?: { name: string; actualValue: string | number }[];
    formulaIngredients?: { name: string; declaredContent?: any }[];
    batchHistory?: { batchNo: string; status: string }[];
  };
}

const DECISION_CONFIG: Record<DeviationDecision, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  RELEASE_WITH_NOTE: { label: 'Xuất với điều kiện', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700', icon: <CheckCircle2 size={18} /> },
  REPROCESS: { label: 'Tái chế / Xử lý lại', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700', icon: <RefreshCw size={18} /> },
  REJECT: { label: 'Từ chối / Tiêu hủy', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700', icon: <X size={18} /> },
  PENDING_INVESTIGATION: { label: 'Chờ điều tra thêm', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700', icon: <Loader2 size={18} /> },
};

const RISK_CONFIG = {
  NEGLIGIBLE: { label: 'Rất thấp', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  LOW: { label: 'Thấp', color: 'text-green-600', dot: 'bg-green-500' },
  MEDIUM: { label: 'Trung bình', color: 'text-amber-600', dot: 'bg-amber-500' },
  HIGH: { label: 'Cao', color: 'text-orange-600', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Nghiêm trọng', color: 'text-red-600', dot: 'bg-red-600' },
};

const CAPA_TYPE_COLOR = {
  IMMEDIATE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  CORRECTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PREVENTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const Section: React.FC<{ icon: React.ReactNode; title: string; badge?: string; badgeColor?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  icon, title, badge, badgeColor = 'bg-slate-100 text-slate-600', children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-indigo-600 dark:text-indigo-400">{icon}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</span>
          {badge && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${badgeColor}`}>{badge}</span>}
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && <div className="p-5 bg-white dark:bg-slate-900/20">{children}</div>}
    </div>
  );
};

export const DeviationReportModal: React.FC<Props> = ({ isOpen, onClose, initialData }) => {
  const [report, setReport] = useState<DeviationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [useAI, setUseAI] = useState(true);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(async (withAI: boolean) => {
    setIsLoading(true);
    setReport(null);
    setProgress({ step: 'Khởi tạo...', percent: 5 });
    try {
      if (withAI) {
        const result = await generateAIDeviationReport(initialData, (step, percent) => {
          setProgress({ step, percent });
        });
        setReport(result);
      } else {
        await new Promise(r => setTimeout(r, 400));
        setReport(generateRuleBasedDeviationReport(initialData));
      }
    } finally {
      setIsLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    if (isOpen) generate(true);
  }, [isOpen, generate]);

  const handleCopy = async () => {
    if (!report) return;
    const text = `BÁO CÁO SAI LỆCH\nMã: ${report.reportId}\nSản phẩm: ${report.productName}\nSố lô: ${report.batchNo}\n\nTÓM TẮT:\n${report.executiveSummary}\n\nNGUYÊN NHÂN GỐC RỄ:\n${report.rootCauseStatement}\n\nQUYẾT ĐỊNH:\n${DECISION_CONFIG[report.decision].label}\n${report.decisionRationale}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printContent = reportRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Deviation Report - ${report?.batchNo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        h1 { color: #1e293b; font-size: 18px; }
        h2 { color: #334155; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 11px; }
        th { background: #f8fafc; font-weight: bold; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; }
        .red { background: #fee2e2; color: #b91c1c; }
        .amber { background: #fef3c7; color: #92400e; }
        .green { background: #dcfce7; color: #166534; }
        @media print { body { margin: 0; } }
      </style></head><body>${printContent}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (!isOpen) return null;

  const decisionCfg = report ? DECISION_CONFIG[report.decision] : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] flex flex-col border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/30">
              <FileWarning size={20} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-slate-100 text-base">Báo cáo Sai lệch (Deviation Report)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialData.productName} — Lô <span className="font-bold text-rose-600">{initialData.batchNo}</span>
                {report && <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">{report.reportId}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && report && (
              <>
                <button onClick={() => generate(!useAI || report.generatedBy === 'AI')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <RefreshCw size={14} /> {report.generatedBy === 'AI' ? 'Tạo lại (AI)' : 'Thử với AI'}
                </button>
                <button onClick={handleCopy} className="text-xs font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép' : 'Sao chép'}
                </button>
                <button onClick={handlePrint} className="text-xs font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <Printer size={14} /> In báo cáo
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={reportRef}>
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 dark:border-indigo-900"></div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={24} className="text-indigo-500" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800 dark:text-slate-100">Gemini AI đang phân tích...</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{progress.step}</p>
              </div>
              <div className="w-72 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress.percent}%` }}></div>
              </div>
            </div>
          )}

          {/* Report Content */}
          {report && !isLoading && (
            <>
              {/* AI Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 ${report.generatedBy === 'AI' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {report.generatedBy === 'AI' ? <><Zap size={10} /> Được tạo bởi Gemini AI</> : 'Được tạo theo quy tắc'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(report.generatedAt).toLocaleString('vi-VN')}</span>
              </div>

              {/* Phần 1: Thông tin sự cố */}
              <Section icon={<AlertTriangle size={16} />} title="1. Mô tả Sự cố">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{report.executiveSummary}</p>
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-bold">Chỉ tiêu không đạt</th>
                        <th className="px-4 py-2.5 text-right font-bold">Thực tế</th>
                        <th className="px-4 py-2.5 text-center font-bold">Yêu cầu</th>
                        <th className="px-4 py-2.5 text-center font-bold">Lệch</th>
                        <th className="px-4 py-2.5 text-center font-bold">Mức độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {report.failedCriteria.map((c, i) => (
                        <tr key={i} className="bg-white dark:bg-slate-900/20">
                          <td className="px-4 py-3 font-bold text-red-700 dark:text-red-400">{c.name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{c.actualValue} {c.unit}</td>
                          <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 font-mono">{c.specification}</td>
                          <td className="px-4 py-3 text-center font-bold text-orange-600">{c.deviationPercent || '---'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : c.severity === 'MAJOR' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {c.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Phần 2: Tác động */}
              <Section icon={<Shield size={16} />} title="2. Đánh giá Tác động Ngay lập tức"
                badge={RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.label || 'N/A'}
                badgeColor={`bg-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-100 text-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-700`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Rủi ro bệnh nhân</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.dot}`}></div>
                      <span className={`font-bold ${RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.color}`}>
                        {RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Cách ly lô</p>
                    <span className={`font-bold ${report.immediateImpact.quarantineRequired ? 'text-red-600' : 'text-emerald-600'}`}>
                      {report.immediateImpact.quarantineRequired ? '⛔ Cần cách ly ngay' : '✅ Không cần'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Phạm vi ảnh hưởng</p>
                    <p className="text-slate-700 dark:text-slate-300">{report.immediateImpact.marketImpactScope}</p>
                  </div>
                  {report.immediateImpact.notificationRequired && (
                    <div className="col-span-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/40">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400">⚠️ Cần thông báo cơ quan quản lý:</p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{report.immediateImpact.notificationScope}</p>
                    </div>
                  )}
                </div>
              </Section>

              {/* Phần 3: RCA */}
              <Section icon={<Target size={16} />} title="3. Phân tích Nguyên nhân Gốc rễ (RCA)">
                <div className="space-y-4">
                  {/* Fishbone summary */}
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Sơ đồ Xương cá (Fishbone 6M)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {report.fishbone.map((cat) => (
                        <div key={cat.category} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">{cat.label} ({cat.category})</p>
                          <ul className="space-y-1">
                            {cat.causes.map((cause, i) => (
                              <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                <span className="text-slate-400 shrink-0 mt-0.5">•</span>{cause}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5-Why */}
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Phân tích 5-Why</p>
                    <div className="space-y-2">
                      {report.fiveWhy.map((why) => (
                        <div key={why.level} className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center mt-0.5">{why.level}</div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{why.question}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 pl-1 border-l-2 border-indigo-200 dark:border-indigo-700">{why.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Root cause */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <p className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase flex items-center gap-1.5 mb-1.5"><Target size={12} /> Kết luận Nguyên nhân Gốc rễ</p>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 font-medium">{report.rootCauseStatement}</p>
                  </div>
                </div>
              </Section>

              {/* Phần 4: CAPA */}
              <Section icon={<ClipboardList size={16} />} title="4. Kế hoạch CAPA">
                <div className="space-y-3">
                  {report.capaItems.map((item) => (
                    <div key={item.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400">{item.id}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CAPA_TYPE_COLOR[item.type] || ''}`}>{item.typeLabel}</span>
                        </div>
                        <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0"><Clock size={11} /> {item.deadline}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{item.action}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User size={11} /> {item.responsible}</span>
                        <span className="flex items-center gap-1"><CheckCircle2 size={11} /> {item.verification}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Phần 5: Tái diễn */}
              <Section icon={<Activity size={16} />} title="5. Đánh giá Nguy cơ Tái diễn" defaultOpen={false}>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">Khả năng tái diễn:</span>
                    <span className={`font-bold ${report.recurrenceRisk.likelihood === 'HIGH' ? 'text-red-600' : report.recurrenceRisk.likelihood === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {report.recurrenceRisk.likelihood === 'HIGH' ? '🔴 Cao' : report.recurrenceRisk.likelihood === 'MEDIUM' ? '⚠️ Trung bình' : '✅ Thấp'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{report.recurrenceRisk.likelihoodReason}</p>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Biện pháp phòng ngừa:</p>
                    <ul className="space-y-1">
                      {report.recurrenceRisk.preventionMeasures.map((m, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                          <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* Phần 6: Quyết định */}
              {decisionCfg && (
                <div className={`rounded-xl border-2 p-5 ${decisionCfg.bg}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={decisionCfg.color}>{decisionCfg.icon}</span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">6. Quyết định Xử lý Lô</p>
                      <p className={`text-xl font-black ${decisionCfg.color}`}>{decisionCfg.label}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-slate-400">Cần phê duyệt bởi</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{report.approvalRequired}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{report.decisionRationale}</p>
                  {report.conditions && report.conditions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1.5">Điều kiện kèm theo:</p>
                      <ul className="space-y-1">
                        {report.conditions.map((c, i) => (
                          <li key={i} className="text-sm flex items-start gap-1.5"><CheckCircle2 size={13} className="text-amber-500 shrink-0 mt-0.5" />{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
