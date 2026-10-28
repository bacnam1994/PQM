import React, { useState } from 'react';
import { 
  OOSInvestigationReport, 
  generateAIOOSInvestigation, 
  generateRuleBasedOOSReport 
} from '../../services/ai/oosInvestigationService';
import { 
  ShieldExclamationIcon, 
  DocumentTextIcon, 
  ChartBarSquareIcon, 
  ArrowsRightLeftIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  PrinterIcon, 
  XMarkIcon, 
  SparklesIcon, 
  UserGroupIcon, 
  CpuChipIcon, 
  Square3Stack3DIcon, 
  AdjustmentsHorizontalIcon, 
  ScaleIcon, 
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface OOSInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    productName: string;
    batchNo: string;
    mfgDate?: string;
    expDate?: string;
    failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[];
    passedCriteria?: { criteriaName: string; actualValue: string | number }[];
    formulaIngredients?: { name: string; declaredContent?: any }[];
    recentBatchesHistory?: { batchNo: string; overallStatus: string; results?: any[] }[];
  };
}

export const OOSInvestigationModal: React.FC<OOSInvestigationModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const [report, setReport] = useState<OOSInvestigationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'investigation' | 'ishikawa' | 'capa'>('overview');

  const handleGenerate = async (forceAI = true) => {
    setLoading(true);
    try {
      if (forceAI) {
        const res = await generateAIOOSInvestigation(initialData);
        setReport(res);
      } else {
        const res = generateRuleBasedOOSReport(initialData);
        setReport(res);
      }
    } catch (err) {
      console.error('Error generating OOS report:', err);
      const fallback = generateRuleBasedOOSReport(initialData);
      setReport(fallback);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !report) {
      handleGenerate(true);
    }
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Man': return <UserGroupIcon className="h-4 w-4 text-blue-500" />;
      case 'Machine': return <CpuChipIcon className="h-4 w-4 text-indigo-500" />;
      case 'Material': return <Square3Stack3DIcon className="h-4 w-4 text-emerald-500" />;
      case 'Method': return <AdjustmentsHorizontalIcon className="h-4 w-4 text-amber-500" />;
      case 'Measurement': return <ScaleIcon className="h-4 w-4 text-purple-500" />;
      default: return <ChartBarSquareIcon className="h-4 w-4 text-ink-muted" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface rounded-2xl w-full max-w-5xl shadow-2xl my-auto overflow-hidden border border-border p-6">
        <div className="flex flex-col max-h-[85vh]">
          {/* Modal Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
                <ShieldExclamationIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                    HỒ SƠ OOS GMP
                  </span>
                  <span className="text-[11px] font-mono font-medium text-ink-muted">
                    {report?.reportId || 'Đang khởi tạo...'}
                  </span>
                </div>
                <h2 className="text-base font-bold text-ink mt-1">
                  Điều Tra Sai Lệch OOS & Hoạch Định CAPA (AI)
                </h2>
                <p className="text-xs text-ink-muted">
                  Sản phẩm: <span className="font-semibold text-ink">{initialData.productName}</span> — Lô: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{initialData.batchNo}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-xs font-semibold transition-all border border-emerald-200 dark:border-emerald-800/40"
                title="Phân tích lại bằng AI"
              >
                <SparklesIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Tạo lại AI
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!report}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-ink text-xs font-semibold transition-all border border-border"
              >
                <PrinterIcon className="h-4 w-4" />
                In hồ sơ
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-all"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Loading Overlay */}
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <ArrowPathIcon className="h-10 w-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-ink text-sm">
                  AI đang rà soát hồ sơ & xây dựng biên bản điều tra OOS...
                </h4>
                <p className="text-xs text-ink-muted mt-1 max-w-md">
                  Phân tích dữ liệu phân tích phòng Lab, thông số sản xuất, cây nguyên nhân 6M Ishikawa và đề xuất kế hoạch hành động CAPA.
                </p>
              </div>
            </div>
          )}

          {/* Content Body */}
          {!loading && report && (
            <div className="flex flex-col flex-1 overflow-hidden mt-3">
              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                {[
                  { key: 'overview', label: '1. Tổng quan & Sự cố', icon: DocumentTextIcon },
                  { key: 'investigation', label: '2. Điều tra 2 giai đoạn (Lab & Sx)', icon: ChartBarSquareIcon },
                  { key: 'ishikawa', label: '3. Ishikawa 6M & 5-Why', icon: ArrowsRightLeftIcon },
                  { key: 'capa', label: '4. Kế hoạch CAPA', icon: CheckCircleIcon },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

            {/* Scrollable Tab Content */}
            <div className="overflow-y-auto flex-1 pr-1 py-4 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Executive Summary Card */}
                  <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400 tracking-wider">
                          Tóm tắt điều hành (Executive Summary)
                        </span>
                        <p className="text-xs font-medium text-ink mt-1.5 leading-relaxed">
                          {report.executiveSummary}
                        </p>
                      </div>
                      <div className="shrink-0 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-center">
                        <span className="text-[9px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider block">Mức rủi ro</span>
                        <span className="text-sm font-bold text-red-700 dark:text-red-300 uppercase">
                          {report.riskAssessment.patientSafetyRisk}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Failed Criteria Table */}
                  <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
                    <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-ink flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                        Danh sách chỉ tiêu lệch chuẩn (Out-of-Specification)
                      </h4>
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                        {report.failedCriteria.length} chỉ tiêu vi phạm
                      </span>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold text-ink-muted uppercase">
                          <th className="px-4 py-2.5">Chỉ tiêu kiểm nghiệm</th>
                          <th className="px-4 py-2.5 text-center">Giới hạn tiêu chuẩn</th>
                          <th className="px-4 py-2.5 text-center">Kết quả thực tế</th>
                          <th className="px-4 py-2.5 text-center">Đánh giá sai lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.failedCriteria.map((f, idx) => (
                          <tr key={idx} className="hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors">
                            <td className="px-4 py-3 font-semibold text-ink">
                              {f.criteriaName}
                            </td>
                            <td className="px-4 py-3 text-center text-ink-muted font-mono">
                              {f.specification} {f.unit || ''}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-red-600 dark:text-red-400">
                              {f.actualValue} {f.unit || ''}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                                KHÔNG ĐẠT (OOS)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Scope & Regulatory Impact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                      <span className="text-[10px] font-semibold uppercase text-ink-muted tracking-wider">
                        Phạm vi ảnh hưởng (Scope Impact)
                      </span>
                      <p className="text-xs font-medium text-ink mt-1">
                        {report.riskAssessment.scopeImpact}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                      <span className="text-[10px] font-semibold uppercase text-ink-muted tracking-wider">
                        Yêu cầu báo cáo cơ quan quản lý
                      </span>
                      <p className="text-xs font-bold text-ink mt-1">
                        {report.riskAssessment.regulatoryNotificationRequired ? '⚠️ Cần thông báo cơ quan quản lý (Cục Quản lý Dược / ATTP)' : '✅ Lưu hồ sơ nội bộ, chưa cần thông báo ngoại viện'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 2-PHASE INVESTIGATION */}
              {activeTab === 'investigation' && (
                <div className="space-y-4">
                  {/* Phase 1: Laboratory */}
                  <div className="p-4 rounded-xl border border-border border-l-4 border-l-emerald-500 bg-surface">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                          Giai đoạn 1 (Phase 1)
                        </span>
                        <h4 className="text-xs font-bold uppercase text-ink">
                          Điều tra Phòng kiểm nghiệm (Laboratory Investigation)
                        </h4>
                      </div>
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${report.phase1LabInvestigation.isLabError ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'}`}>
                        {report.phase1LabInvestigation.isLabError ? 'Lỗi từ Lab' : 'Loại trừ lỗi Lab'}
                      </span>
                    </div>

                    <p className="text-xs text-ink mt-2 font-medium">
                      {report.phase1LabInvestigation.summary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">1. Thiết bị & Hiệu chuẩn</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase1LabInvestigation.equipmentCheck}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">2. Chất chuẩn & Thuốc thử</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase1LabInvestigation.standardAndReagentCheck}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">3. Thao tác chuẩn bị mẫu</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase1LabInvestigation.samplePrepCheck}</p>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300">
                      <span className="font-bold">Kết luận Lab:</span> {report.phase1LabInvestigation.labVerdict}
                    </div>
                  </div>

                  {/* Phase 2: Manufacturing */}
                  <div className="p-4 rounded-xl border border-border border-l-4 border-l-amber-500 bg-surface">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                          Giai đoạn 2 (Phase 2)
                        </span>
                        <h4 className="text-xs font-bold uppercase text-ink">
                          Điều tra Quy trình Sản xuất (Manufacturing Investigation)
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-ink mt-2 font-medium">
                      {report.phase2ManufacturingInvestigation.summary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">1. Nguyên liệu đầu vào</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase2ManufacturingInvestigation.rawMaterialReview}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">2. Thông số công đoạn</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase2ManufacturingInvestigation.processParametersReview}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase block">3. Môi trường phòng sạch</span>
                        <p className="text-[11px] text-ink mt-1">{report.phase2ManufacturingInvestigation.environmentReview}</p>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300">
                      <span className="font-bold">Kết luận Sản xuất:</span> {report.phase2ManufacturingInvestigation.manufacturingVerdict}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ISHIKAWA & 5-WHY */}
              {activeTab === 'ishikawa' && (
                <div className="space-y-4">
                  {/* Root cause summary banner */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-100 block">
                      Tuyên bố nguyên nhân cốt lõi (Root Cause Statement)
                    </span>
                    <p className="text-xs font-bold mt-1 leading-relaxed">
                      {report.rootCauseStatement}
                    </p>
                  </div>

                  {/* 6M Ishikawa Fishbone Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-ink mb-2 flex items-center gap-1.5">
                      <ArrowsRightLeftIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Sơ đồ xương cá phân tích nguyên nhân 6M (Ishikawa Fishbone)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {report.ishikawaDiagram.map((cat, i) => (
                        <div key={i} className="p-3 rounded-xl border border-border bg-surface shadow-sm">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            {getCategoryIcon(cat.category)}
                            <h5 className="text-xs font-bold text-ink">
                              {cat.vietnameseLabel}
                            </h5>
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs text-ink-muted">
                            {cat.causes.map((c, cIdx) => (
                              <li key={cIdx} className="flex items-start gap-1.5 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5-Why Analysis Progression */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-ink mb-2 flex items-center gap-1.5">
                      <ChartBarSquareIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Phương pháp suy luận 5-Why (5 Câu hỏi tại sao)
                    </h4>
                    <div className="space-y-2">
                      {report.fiveWhyAnalysis.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-border text-xs">
                          <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                            {item.level}
                          </span>
                          <div className="flex-1">
                            <span className="font-semibold text-ink">
                              Hỏi: {item.question}
                            </span>
                            <p className="text-ink-muted mt-0.5">
                              ➔ Đáp: {item.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CAPA PLAN */}
              {activeTab === 'capa' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
                    <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-ink flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                        Kế hoạch hành động khắc phục & phòng ngừa (CAPA Plan)
                      </h4>
                      <span className="text-[11px] font-semibold text-ink-muted">
                        {report.capaPlan.length} hành động được thiết lập
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold text-ink-muted uppercase">
                          <th className="px-4 py-2.5">Phân loại</th>
                          <th className="px-4 py-2.5">Nội dung hành động</th>
                          <th className="px-4 py-2.5">Người phụ trách</th>
                          <th className="px-4 py-2.5">Thời hạn</th>
                          <th className="px-4 py-2.5">Bằng chứng nghiệm thu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.capaPlan.map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-2 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                item.type === 'CORRECTION'
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                                  : item.type === 'CORRECTIVE'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              }`}>
                                {item.type === 'CORRECTION' ? 'Khắc phục ngay' : item.type === 'CORRECTIVE' ? 'Hành động KP' : 'Phòng ngừa'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-ink">
                              {item.action}
                            </td>
                            <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {item.responsible}
                            </td>
                            <td className="px-4 py-3 text-ink-muted whitespace-nowrap font-mono text-[11px]">
                              {item.deadline}
                            </td>
                            <td className="px-4 py-3 text-ink-muted text-[11px]">
                              {item.verificationMethod}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-ink">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                        Quy trình phê duyệt & Đóng hồ sơ CAPA (GMP Standard):
                      </span>
                      Hồ sơ OOS và Kế hoạch CAPA cần được ký duyệt bởi Trưởng phòng QA và Giám đốc Nhà máy. Sau khi hoàn thành các bằng chứng nghiệm thu, hồ sơ sẽ được lưu trữ tối thiểu 05 năm phục vụ thanh tra Dược.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-[11px] text-ink-muted">
            Hệ thống Quản lý Chất lượng PQM • Tiêu chuẩn PIC/S & GMP WHO
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-ink font-semibold text-xs border border-border transition-colors"
          >
            Đóng hồ sơ
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};
