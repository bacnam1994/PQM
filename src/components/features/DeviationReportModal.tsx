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
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PrinterIcon,
  DocumentDuplicateIcon,
  BoltIcon,
  ClockIcon,
  UserIcon,
  ChartBarSquareIcon
} from '@heroicons/react/24/outline';
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
  RELEASE_WITH_NOTE: { label: 'Xuất với điều kiện', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', icon: <CheckCircleIcon className="h-5 w-5" /> },
  REPROCESS: { label: 'Tái chế / Xử lý lại', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800', icon: <ArrowPathIcon className="h-5 w-5" /> },
  REJECT: { label: 'Từ chối / Tiêu hủy', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', icon: <XMarkIcon className="h-5 w-5" /> },
  PENDING_INVESTIGATION: { label: 'Chờ điều tra thêm', color: 'text-ink-muted', bg: 'bg-surface-2 border-border', icon: <ArrowPathIcon className="h-5 w-5 animate-spin" /> },
};

const RISK_CONFIG = {
  NEGLIGIBLE: { label: 'Rất thấp', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  LOW: { label: 'Thấp', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  MEDIUM: { label: 'Trung bình', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  HIGH: { label: 'Cao', color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Nghiêm trọng', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-600' },
};

const CAPA_TYPE_COLOR = {
  IMMEDIATE: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300',
  CORRECTIVE: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  PREVENTIVE: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
};

const Section: React.FC<{ icon: React.ReactNode; title: string; badge?: string; badgeColor?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  icon, title, badge, badgeColor = 'bg-surface-2 text-ink-muted', children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-surface-2 hover:bg-surface-3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
          <span className="font-bold text-ink text-sm">{title}</span>
          {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeColor}`}>{badge}</span>}
        </div>
        {open ? <ChevronDownIcon className="h-4 w-4 text-ink-muted" /> : <ChevronRightIcon className="h-4 w-4 text-ink-muted" />}
      </button>
      {open && <div className="p-5 bg-surface">{children}</div>}
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-ink text-base">Báo cáo Sai lệch (Deviation Report)</h2>
              <p className="text-xs text-ink-muted">
                {initialData.productName} — Lô <span className="font-bold text-red-600 dark:text-red-400">{initialData.batchNo}</span>
                {report && <span className="ml-2 text-[10px] bg-surface-2 px-2 py-0.5 rounded font-mono text-ink-muted">{report.reportId}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && report && (
              <>
                <button 
                  type="button"
                  onClick={() => generate(!useAI || report.generatedBy === 'AI')} 
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ArrowPathIcon className="h-4 w-4" /> {report.generatedBy === 'AI' ? 'Tạo lại (AI)' : 'Thử với AI'}
                </button>
                <button 
                  type="button"
                  onClick={handleCopy} 
                  className="text-xs font-semibold text-ink-muted hover:text-ink bg-surface-2 hover:bg-surface-3 border border-border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {copied ? <CheckCircleIcon className="h-4 w-4 text-emerald-500" /> : <DocumentDuplicateIcon className="h-4 w-4" />}
                  {copied ? 'Đã sao chép' : 'Sao chép'}
                </button>
                <button 
                  type="button"
                  onClick={handlePrint} 
                  className="text-xs font-semibold text-ink-muted hover:text-ink bg-surface-2 hover:bg-surface-3 border border-border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <PrinterIcon className="h-4 w-4" /> In báo cáo
                </button>
              </>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={reportRef}>
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="relative">
                <ArrowPathIcon className="h-10 w-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-bold text-ink">Gemini AI đang phân tích...</p>
                <p className="text-xs text-ink-muted mt-1">{progress.step}</p>
              </div>
              <div className="w-72 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress.percent}%` }}></div>
              </div>
            </div>
          )}

          {/* Report Content */}
          {report && !isLoading && (
            <>
              {/* AI Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${report.generatedBy === 'AI' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40' : 'bg-surface-2 text-ink-muted border border-border'}`}>
                  {report.generatedBy === 'AI' ? <><BoltIcon className="h-3 w-3" /> Được tạo bởi Gemini AI</> : 'Được tạo theo quy tắc'}
                </span>
                <span className="text-[10px] text-ink-muted">{new Date(report.generatedAt).toLocaleString('vi-VN')}</span>
              </div>

              {/* Phần 1: Thông tin sự cố */}
              <Section icon={<ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />} title="1. Mô tả Sự cố">
                <p className="text-xs text-ink leading-relaxed mb-4">{report.executiveSummary}</p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 text-ink-muted">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Chỉ tiêu không đạt</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Thực tế</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Yêu cầu</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Lệch</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Mức độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {report.failedCriteria.map((c, i) => (
                        <tr key={i} className="bg-surface">
                          <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400">{c.name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-ink">{c.actualValue} {c.unit}</td>
                          <td className="px-4 py-3 text-center text-ink-muted font-mono">{c.specification}</td>
                          <td className="px-4 py-3 text-center font-bold text-amber-600">{c.deviationPercent || '---'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : c.severity === 'MAJOR' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-surface-2 text-ink-muted'}`}>
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
              <Section icon={<ShieldCheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} title="2. Đánh giá Tác động Ngay lập tức"
                badge={RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.label || 'N/A'}
                badgeColor={`bg-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-100 dark:bg-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-950/40 text-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-700 dark:text-${report.immediateImpact.patientSafetyRisk === 'HIGH' || report.immediateImpact.patientSafetyRisk === 'CRITICAL' ? 'red' : 'amber'}-300`}>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-ink-muted mb-1 uppercase">Rủi ro bệnh nhân</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.dot}`}></div>
                      <span className={`font-bold ${RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.color}`}>
                        {RISK_CONFIG[report.immediateImpact.patientSafetyRisk]?.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-ink-muted mb-1 uppercase">Cách ly lô</p>
                    <span className={`font-bold ${report.immediateImpact.quarantineRequired ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {report.immediateImpact.quarantineRequired ? '⛔ Cần cách ly ngay' : '✅ Không cần'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-ink-muted mb-1 uppercase">Phạm vi ảnh hưởng</p>
                    <p className="text-ink font-medium">{report.immediateImpact.marketImpactScope}</p>
                  </div>
                  {report.immediateImpact.notificationRequired && (
                    <div className="col-span-2 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200 dark:border-red-900/40">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400">⚠️ Cần thông báo cơ quan quản lý:</p>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1">{report.immediateImpact.notificationScope}</p>
                    </div>
                  )}
                </div>
              </Section>

              {/* Phần 3: RCA */}
              <Section icon={<ChartBarSquareIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} title="3. Phân tích Nguyên nhân Gốc rễ (RCA)">
                <div className="space-y-4">
                  {/* Fishbone summary */}
                  <div>
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Sơ đồ Xương cá (Fishbone 6M)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.fishbone.map((cat) => (
                        <div key={cat.category} className="bg-surface-2 rounded-xl p-3 border border-border">
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">{cat.label} ({cat.category})</p>
                          <ul className="space-y-1">
                            {cat.causes.map((cause, i) => (
                              <li key={i} className="text-xs text-ink-muted flex items-start gap-1.5">
                                <span className="text-ink-muted shrink-0 mt-0.5">•</span>{cause}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5-Why */}
                  <div>
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Phân tích 5-Why</p>
                    <div className="space-y-2">
                      {report.fiveWhy.map((why) => (
                        <div key={why.level} className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5 border border-emerald-200 dark:border-emerald-800/40">{why.level}</div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-ink">{why.question}</p>
                            <p className="text-xs text-ink-muted mt-0.5 pl-1 border-l-2 border-emerald-300 dark:border-emerald-700">{why.answer}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Root cause */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase flex items-center gap-1.5 mb-1.5">
                      <ChartBarSquareIcon className="h-4 w-4" /> Kết luận Nguyên nhân Gốc rễ
                    </p>
                    <p className="text-xs text-ink font-medium">{report.rootCauseStatement}</p>
                  </div>
                </div>
              </Section>

              {/* Phần 4: CAPA */}
              <Section icon={<ClipboardDocumentListIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} title="4. Kế hoạch CAPA">
                <div className="space-y-3">
                  {report.capaItems.map((item) => (
                    <div key={item.id} className="border border-border rounded-xl p-4 bg-surface-2">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-ink-muted">{item.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAPA_TYPE_COLOR[item.type] || ''}`}>{item.typeLabel}</span>
                        </div>
                        <span className="text-xs text-ink-muted flex items-center gap-1 shrink-0"><ClockIcon className="h-3.5 w-3.5" /> {item.deadline}</span>
                      </div>
                      <p className="text-xs font-semibold text-ink mb-2">{item.action}</p>
                      <div className="flex items-center gap-4 text-xs text-ink-muted">
                        <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {item.responsible}</span>
                        <span className="flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" /> {item.verification}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Phần 5: Tái diễn */}
              <Section icon={<ArrowPathIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} title="5. Đánh giá Nguy cơ Tái diễn" defaultOpen={false}>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-muted">Khả năng tái diễn:</span>
                    <span className={`font-bold ${report.recurrenceRisk.likelihood === 'HIGH' ? 'text-red-600' : report.recurrenceRisk.likelihood === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {report.recurrenceRisk.likelihood === 'HIGH' ? '🔴 Cao' : report.recurrenceRisk.likelihood === 'MEDIUM' ? '⚠️ Trung bình' : '✅ Thấp'}
                    </span>
                  </div>
                  <p className="text-ink-muted">{report.recurrenceRisk.likelihoodReason}</p>
                  <div>
                    <p className="text-[10px] font-bold text-ink-muted uppercase mb-2">Biện pháp phòng ngừa:</p>
                    <ul className="space-y-1">
                      {report.recurrenceRisk.preventionMeasures.map((m, i) => (
                        <li key={i} className="text-xs text-ink flex items-start gap-2">
                          <LightBulbIcon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* Phần 6: Quyết định */}
              {decisionCfg && (
                <div className={`rounded-xl border p-5 ${decisionCfg.bg}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={decisionCfg.color}>{decisionCfg.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">6. Quyết định Xử lý Lô</p>
                      <p className={`text-lg font-bold ${decisionCfg.color}`}>{decisionCfg.label}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-ink-muted">Cần phê duyệt bởi</p>
                      <p className="font-bold text-ink">{report.approvalRequired}</p>
                    </div>
                  </div>
                  <p className="text-xs text-ink">{report.decisionRationale}</p>
                  {report.conditions && report.conditions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-ink-muted uppercase mb-1.5">Điều kiện kèm theo:</p>
                      <ul className="space-y-1">
                        {report.conditions.map((c, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5 text-ink"><CheckCircleIcon className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />{c}</li>
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
        <div className="px-6 py-3 border-t border-border bg-surface-2 flex justify-end gap-2 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface border border-border rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
